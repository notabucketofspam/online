#include <iostream>
#include <string>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <vector>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "ws2_32.lib")

#define BUFFER_SIZE 65536

// Helper function
bool is_same_endpoint(const sockaddr_storage& sender, const sockaddr_storage& remote) {
  if (sender.ss_family != remote.ss_family) return false;
  if (sender.ss_family == AF_INET) {
    auto s = (struct sockaddr_in*)&sender;
    auto r = (struct sockaddr_in*)&remote;
    return (s->sin_addr.s_addr == r->sin_addr.s_addr) && (s->sin_port == r->sin_port);
  } else if (sender.ss_family == AF_INET6) {
    auto s = (struct sockaddr_in6*)&sender;
    auto r = (struct sockaddr_in6*)&remote;
    return (memcmp(&s->sin6_addr, &r->sin6_addr, sizeof(in6_addr)) == 0) && (s->sin6_port == r->sin6_port);
  }
  return false;
}

int main(int argc, char* argv[]) {
  // We now expect 5 arguments (6 including executable)
  if (argc != 6) {
    std::cerr << "Usage: udp_relay.exe <local_bind_port> <local_target_port> <coord_host> <coord_port> <request_id>" << std::endl;
    return 1;
  }

  const char* LOCAL_BIND_PORT = argv[1];
  int LOCAL_TARGET_PORT = std::atoi(argv[2]); // 0 = dynamic learning, >0 = static server
  const char* COORD_HOST = argv[3];
  const char* COORD_PORT = argv[4];
  const char* REQUEST_ID = argv[5];

  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return 1;

  // 1. Create and Bind the Main Socket
  SOCKET sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);

  struct sockaddr_in listen_addr;
  memset(&listen_addr, 0, sizeof(listen_addr));
  listen_addr.sin_family = AF_INET;
  listen_addr.sin_addr.s_addr = INADDR_ANY;
  listen_addr.sin_port = htons(std::atoi(LOCAL_BIND_PORT));

  if (bind(sock, (struct sockaddr*)&listen_addr, sizeof(listen_addr)) == SOCKET_ERROR) {
    std::cerr << "Failed to bind socket." << std::endl;
    return 1;
  }

  // Print the bound port (helpful if we bound to 0)
  struct sockaddr_in current_addr;
  int current_len = sizeof(current_addr);
  if (getsockname(sock, (struct sockaddr*)&current_addr, &current_len) != SOCKET_ERROR) {
    std::cout << "READY:" << ntohs(current_addr.sin_port) << std::endl;
  }

  // 2. Fire the Hole-Punch STUN Packet
  struct addrinfo coord_hints, * coord_info;
  memset(&coord_hints, 0, sizeof(coord_hints));
  coord_hints.ai_family = AF_UNSPEC;
  coord_hints.ai_socktype = SOCK_DGRAM;

  if (getaddrinfo(COORD_HOST, COORD_PORT, &coord_hints, &coord_info) == 0) {
    sendto(sock, REQUEST_ID, std::strlen(REQUEST_ID), 0, coord_info->ai_addr, coord_info->ai_addrlen);
    freeaddrinfo(coord_info);
    std::cout << "[Startup] Fired request_id to coordinator." << std::endl;
  }

  // 3. Pause and wait for Node.js to give us the Peer IP and Port via stdin!
  std::cout << "AWAITING_PEER_INFO" << std::endl;
  std::string remote_ip_str, remote_port_str;
  std::cin >> remote_ip_str >> remote_port_str;

  // Resolve the peer info we just received
  struct addrinfo hints, * remote_info;
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_DGRAM;

  if (getaddrinfo(remote_ip_str.c_str(), remote_port_str.c_str(), &hints, &remote_info) != 0) {
    std::cerr << "Failed to resolve remote IP." << std::endl;
    WSACleanup();
    return 1;
  }

  struct sockaddr_storage remote_addr_storage;
  memcpy(&remote_addr_storage, remote_info->ai_addr, remote_info->ai_addrlen);
  freeaddrinfo(remote_info);
  std::cout << "[IPC] Locked onto remote peer: " << remote_ip_str << ":" << remote_port_str << std::endl;

  // 4. Setup Local Target Logic
  struct sockaddr_storage local_app_addr;
  int local_app_len = sizeof(local_app_addr);
  bool local_app_known = false;

  // If we are in Server Mode, hardcode the Factorio server target immediately
  if (LOCAL_TARGET_PORT > 0) {
    struct sockaddr_in* addr = (struct sockaddr_in*)&local_app_addr;
    addr->sin_family = AF_INET;
    addr->sin_port = htons(LOCAL_TARGET_PORT);
    inet_pton(AF_INET, "127.0.0.1", &addr->sin_addr);
    local_app_len = sizeof(struct sockaddr_in);
    local_app_known = true;
    std::cout << "[Mode] Peer Server: Hardcoded local target to port " << LOCAL_TARGET_PORT << std::endl;
  } else {
    std::cout << "[Mode] Peer Client: Waiting to learn local app port dynamically..." << std::endl;
  }

  // Timer setup & Buffer allocation
  using namespace std::chrono;
  auto last_keepalive_sent = steady_clock::now();
  auto last_packet_received = steady_clock::now();
  std::vector<char> buffer(BUFFER_SIZE);

  struct sockaddr_storage sender_addr;
  int sender_len = sizeof(sender_addr);

  // 5. The Event Loop
  while (true) {
    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(sock, &readfds);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 100000;

    int activity = select(0, &readfds, NULL, NULL, &tv);
    auto now = steady_clock::now();

    if (activity > 0 && FD_ISSET(sock, &readfds)) {
      int received_bytes = recvfrom(sock, buffer.data(), BUFFER_SIZE, 0,
        (struct sockaddr*)&sender_addr, &sender_len);

      if (received_bytes != SOCKET_ERROR) {
        if (is_same_endpoint(sender_addr, remote_addr_storage)) {
          last_packet_received = now;

          // FILTER CHECK
          if (received_bytes == 5 && std::memcmp(buffer.data(), "PUNCH", 5) == 0) continue;

          if (local_app_known) {
            sendto(sock, buffer.data(), received_bytes, 0,
              (struct sockaddr*)&local_app_addr, local_app_len);
          }
        } else {
          // Only learn dynamically if we are in Client Mode (Target == 0)
          if (LOCAL_TARGET_PORT == 0) {
            if (!local_app_known || !is_same_endpoint(sender_addr, local_app_addr)) {
              local_app_addr = sender_addr;
              local_app_len = sender_len;
              local_app_known = true;
              std::cout << "Learned local app's return port!" << std::endl;
            }
          }

          sendto(sock, buffer.data(), received_bytes, 0,
            (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
        }
      }
    }

    // TIMER CHECKS
    if (duration_cast<seconds>(now - last_keepalive_sent).count() >= 25) {
      sendto(sock, "PUNCH", 5, 0, (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
      last_keepalive_sent = now;
    }

    if (duration_cast<seconds>(now - last_packet_received).count() >= 80) break;
  }

  closesocket(sock);
  WSACleanup();
  return 0;
}
