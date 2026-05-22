#include <iostream>
#include <string>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <vector>

#include <fstream>

#ifdef _WIN32
// Windows-specific includes and types
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")

typedef int sock_len_t; // Windows uses int for address lengths
#else
// Linux/POSIX-specific includes and types
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <netdb.h>

// Map Windows types to POSIX equivalents so the rest of the code stays the same
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close

typedef socklen_t sock_len_t; // Linux uses socklen_t
#endif

#define BUFFER_SIZE 65536

// Are these two addresses the same?
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
  if (argc != 6) {
    std::cerr << "Usage: udp_relay <local_bind_port> <local_target_port> <coord_host> <coord_port> <request_id>" << std::endl;
    return 1;
  }

  std::ofstream nullStream;
#ifndef ENABLE_DEBUG_MESSAGES
  std::cout.rdbuf(nullStream.rdbuf());
#endif

  const char* LOCAL_BIND_PORT = argv[1];
  int LOCAL_TARGET_PORT = std::atoi(argv[2]);
  const char* COORD_HOST = argv[3];
  const char* COORD_PORT = argv[4];
  const char* REQUEST_ID = argv[5];

#ifdef _WIN32
  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return 1;
#endif

  // the udp socket that does all the listening
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

  // where we are right now
  struct sockaddr_in current_addr;
  sock_len_t current_len = sizeof(current_addr);
  if (getsockname(sock, (struct sockaddr*)&current_addr, &current_len) != SOCKET_ERROR) {
    std::cout << "READY:" << ntohs(current_addr.sin_port) << std::endl;
  }

  // Send request_id to WSBC
  struct addrinfo coord_hints, * coord_info;
  memset(&coord_hints, 0, sizeof(coord_hints));
  coord_hints.ai_family = AF_UNSPEC;
  coord_hints.ai_socktype = SOCK_DGRAM;

  if (getaddrinfo(COORD_HOST, COORD_PORT, &coord_hints, &coord_info) == 0) {
    // actually send the request to WSBC (handled by grandFacade)
    sendto(sock, REQUEST_ID,
#ifdef _WIN32
    (int)
#endif
      std::strlen(REQUEST_ID), 0, coord_info->ai_addr,
#ifdef _WIN32
      (int)
#endif
      coord_info->ai_addrlen);
    freeaddrinfo(coord_info);
    std::cout << "Sent request_id to grandFacade" << std::endl;
    //std::cout.flush();
  } else {
    // somehow failed to send a single udp packet to WSBC. sad.
  }

  // we need to know the remote peer's address and port
  std::cout << "AWAITING_PEER_INFO" << std::endl;
  std::string remote_ip_str, remote_port_str;
  std::cin >> remote_ip_str >> remote_port_str;

  struct addrinfo hints, * remote_info;
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_DGRAM;

  if (getaddrinfo(remote_ip_str.c_str(), remote_port_str.c_str(), &hints, &remote_info) != 0) {
    std::cerr << "Failed to resolve remote IP." << std::endl;
#ifdef _WIN32
    WSACleanup();
#endif
    return 1;
  }

  struct sockaddr_storage remote_addr_storage;
  memcpy(&remote_addr_storage, remote_info->ai_addr, remote_info->ai_addrlen);
  freeaddrinfo(remote_info);
  std::cout << "remote peer is: " << remote_ip_str << " " << remote_port_str << std::endl;

  // local address
  struct sockaddr_storage local_addr_storage;
  sock_len_t local_app_len = sizeof(local_addr_storage);
  bool local_app_known = false;

  // figure out how to talk to the local app
  if (LOCAL_TARGET_PORT > 0) {
    // we are in server mode
    struct sockaddr_in* addr = (struct sockaddr_in*)&local_addr_storage;
    addr->sin_family = AF_INET;
    addr->sin_port = htons(LOCAL_TARGET_PORT);
    inet_pton(AF_INET, "127.0.0.1", &addr->sin_addr);
    local_app_len = sizeof(struct sockaddr_in);
    local_app_known = true;
    //std::cout << "server mode " << LOCAL_TARGET_PORT << std::endl;
  } else {
    // we are in client mode
    //std::cout << "client mode" << std::endl;
  }

  using namespace std::chrono;
  auto last_keepalive_sent = steady_clock::now();
  auto last_packet_received = steady_clock::now();

  // the actual buffer that holds the incoming udp packet
  std::vector<char> buffer(BUFFER_SIZE);

  struct sockaddr_storage sender_addr;
  sock_len_t sender_len = sizeof(sender_addr);

  // The Event Loop
  while (true) {
    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(sock, &readfds);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 100000;

    // check for udp socket activity
    int activity = select(
#ifdef _WIN32
    (int)
#endif
      (sock + 1), &readfds, NULL, NULL, &tv);
    auto now = steady_clock::now();

    if (activity > 0 && FD_ISSET(sock, &readfds)) {
      // there's activity on the udp socket

      // read in the received data
      int received_bytes = recvfrom(sock, buffer.data(), BUFFER_SIZE, 0,
        (struct sockaddr*)&sender_addr, &sender_len);

      if (received_bytes != SOCKET_ERROR) {
        if (is_same_endpoint(sender_addr, remote_addr_storage)) {
          // we got a message from the remote peer

          last_packet_received = now;

          // if it's a keepalive, skip to the next iteration
          if (received_bytes == 5 && std::memcmp(buffer.data(), "PUNCH", 5) == 0) {
            continue;
          }

          if (local_app_known) {
            // we know the local app's info
            
            // send this data to the local app
            sendto(sock, buffer.data(), received_bytes, 0,
              (struct sockaddr*)&local_addr_storage, local_app_len);
          } else {
            // the local app's info is not yet known to us
          }
        } else {
          // we got a message from the local app
          if (LOCAL_TARGET_PORT == 0) {
            // we are in client mode

            if (!local_app_known || !is_same_endpoint(sender_addr, local_addr_storage)) {
              // we need to learn the local app's info
              local_addr_storage = sender_addr;
              local_app_len = sender_len;
              local_app_known = true;
              std::cout << "local addr now known" << std::endl;
            } else {
              // we already know the local app's info
            }
          } else {
            // we are in server mode, so we already know stuff
          }

          // actually send the data to the remote peer
          sendto(sock, buffer.data(), received_bytes, 0,
            (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
        }
      } else {
        // there was a socket error
      }
    } else {
      // there's no activity on the socket
    }

    // send a keepalive every 25 seconds
    if (duration_cast<seconds>(now - last_keepalive_sent).count() >= 10) {
      sendto(sock, "PUNCH", 5, 0, (struct sockaddr*)&remote_addr_storage, sizeof(remote_addr_storage));
      last_keepalive_sent = now;
    }

    // if no incoming data after 80 seconds, terminate
    if (duration_cast<seconds>(now - last_packet_received).count() >= 80) {
      break;
    }
  } // end of the event loop

  closesocket(sock);
#ifdef _WIN32
  WSACleanup();
#endif
  return 0;
}
