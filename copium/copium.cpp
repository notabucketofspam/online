#include <iostream>
#include <string>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "ws2_32.lib")

#define BUFFER_SIZE 65536

// Helper function to check if a packet came from our Known Remote Peer
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
  // We only need 3 arguments now! 
  // Listen Port, Remote IP (v4 or v6), Remote Port.
  if (argc != 4) {
    std::cerr << "Usage: udp_relay.exe <listen_port> <remote_ip> <remote_port>" << std::endl;
    return 1;
  }

  const char* LISTEN_PORT = argv[1];
  const char* REMOTE_IP = argv[2];
  const char* REMOTE_PORT = argv[3];

  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return 1;

  // 1. IP Agnostic Remote Resolution (Dual-Stack)
  struct addrinfo hints, * remote_info;
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;    // Tell the OS: "I don't care if it's v4 or v6"
  hints.ai_socktype = SOCK_DGRAM; // UDP

  if (getaddrinfo(REMOTE_IP, REMOTE_PORT, &hints, &remote_info) != 0) {
    std::cerr << "Failed to resolve remote IP." << std::endl;
    WSACleanup();
    return 1;
  }

  // 2. Create the socket based on whatever the Remote IP actually is
  SOCKET sock = socket(remote_info->ai_family, remote_info->ai_socktype, remote_info->ai_protocol);

  // If the remote is IPv6, we MUST tell Windows to also allow IPv4 traffic 
  // on this socket so the local game (127.0.0.1) can still talk to it!
  if (remote_info->ai_family == AF_INET6) {
    DWORD v6only = 0;
    setsockopt(sock, IPPROTO_IPV6, IPV6_V6ONLY, (const char*)&v6only, sizeof(v6only));
  }

  // 3. Bind to the listening port
  struct sockaddr_storage listen_addr;
  memset(&listen_addr, 0, sizeof(listen_addr));
  listen_addr.ss_family = remote_info->ai_family;

  if (listen_addr.ss_family == AF_INET) {
    ((struct sockaddr_in*)&listen_addr)->sin_addr.s_addr = INADDR_ANY;
    ((struct sockaddr_in*)&listen_addr)->sin_port = htons(std::atoi(LISTEN_PORT));
  } else {
    ((struct sockaddr_in6*)&listen_addr)->sin6_addr = in6addr_any;
    ((struct sockaddr_in6*)&listen_addr)->sin6_port = htons(std::atoi(LISTEN_PORT));
  }

  if (bind(sock, (struct sockaddr*)&listen_addr, remote_info->ai_addrlen) == SOCKET_ERROR) {
    std::cerr << "Failed to bind socket." << std::endl;
    return 1;
  }

  // 4. State Variables
  // We copy the remote address into a clean storage struct so we can compare it easily
  struct sockaddr_storage remote_addr_storage;
  memcpy(&remote_addr_storage, remote_info->ai_addr, remote_info->ai_addrlen);
  freeaddrinfo(remote_info); // Clean up the memory from getaddrinfo

  struct sockaddr_storage local_app_addr;
  int local_app_len = 0;
  bool local_app_known = false;

  // Timer setup
  using namespace std::chrono;
  auto last_keepalive_sent = steady_clock::now();
  auto last_packet_received = steady_clock::now(); // Start the 80s countdown now

  char buffer[BUFFER_SIZE];
  struct sockaddr_storage sender_addr;
  int sender_len = sizeof(sender_addr);

  std::cout << "Relay listening on port " << LISTEN_PORT << std::endl;

  // 5. The Event Loop
  while (true) {
    // We use select() to create a timeout. It waits up to 100ms for a packet.
    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(sock, &readfds);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 100000; // 100 milliseconds

    int activity = select(0, &readfds, NULL, NULL, &tv);
    auto now = steady_clock::now();

    // If activity > 0, we actually received a packet!
    if (activity > 0 && FD_ISSET(sock, &readfds)) {
      int received_bytes = recvfrom(sock, buffer, BUFFER_SIZE, 0,
        (struct sockaddr*)&sender_addr, &sender_len);

      if (received_bytes != SOCKET_ERROR) {
        bool is_from_remote = is_same_endpoint(sender_addr, remote_addr_storage);

        if (is_from_remote) {
          // Update the timeout watchdog because the remote side is alive!
          last_packet_received = now;

          // FILTER CHECK: Is this the 5-byte keepalive?
          if (received_bytes == 5 && std::memcmp(buffer, "PUNCH", 5) == 0) {
            // It is a keepalive. Drop it and continue the loop.
            continue;
          }

          // Forward actual game traffic to the local app (if we know where it is)
          if (local_app_known) {
            sendto(sock, buffer, received_bytes, 0,
              (struct sockaddr*)&local_app_addr, local_app_len);
          }
        } else {
          // If it is NOT from the remote peer, we assume it's the local app (Factorio).
          if (!local_app_known || !is_same_endpoint(sender_addr, local_app_addr)) {
            local_app_addr = sender_addr;
            local_app_len = sender_len;
            local_app_known = true;
            std::cout << "Learned local app's return port!" << std::endl;
          }

          // Forward the local app's packet out to the WAN
          sendto(sock, buffer, received_bytes, 0,
            (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
        }
      }
    }

    // --- TIMER CHECKS ---

    // 1. Send our keepalive every 25 seconds
    if (duration_cast<seconds>(now - last_keepalive_sent).count() >= 25) {
      sendto(sock, "PUNCH", 5, 0, (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
      last_keepalive_sent = now;
      std::cout << "[Keepalive Sent]" << std::endl;
    }

    // 2. Shut down if the remote peer goes silent for 80 seconds
    if (duration_cast<seconds>(now - last_packet_received).count() >= 80) {
      std::cerr << "Timeout: No packets received from remote peer in 80 seconds. Closing." << std::endl;
      break;
    }
  }

  closesocket(sock);
  WSACleanup();
  return 0;
}
