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

// Windows uses int for address lengths
typedef int sock_len_t;

// you can't just say perchance
#define perchance (int)
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

// Linux uses socklen_t
typedef socklen_t sock_len_t;

#define perchance
#endif

#define BUFFER_SIZE 65536

// Are these two addresses the same?
bool is_same_endpoint(const struct sockaddr_storage& a, const struct sockaddr_storage& b) {
  // If the address families don't match, they aren't the same endpoint
  if (a.ss_family != b.ss_family) {
    return false;
  }

  // Dual-stack sockets output AF_INET6 for both IPv6 and IPv4 (mapped) traffic
  if (a.ss_family == AF_INET6) {
    struct sockaddr_in6* addr_a = (struct sockaddr_in6*)&a;
    struct sockaddr_in6* addr_b = (struct sockaddr_in6*)&b;
    // 1. Check if the ports match
    if (addr_a->sin6_port != addr_b->sin6_port) {
      return false;
    }
    // 2. Check if the IP addresses match (using memcmp ONLY on the 16-byte IP struct)
    return memcmp(&(addr_a->sin6_addr), &(addr_b->sin6_addr), sizeof(struct in6_addr)) == 0;
  }

  // Fallback just in case a native AF_INET packet slips through
  if (a.ss_family == AF_INET) {
    struct sockaddr_in* addr_a = (struct sockaddr_in*)&a;
    struct sockaddr_in* addr_b = (struct sockaddr_in*)&b;
    if (addr_a->sin_port != addr_b->sin_port) {
      return false;
    }
    return addr_a->sin_addr.s_addr == addr_b->sin_addr.s_addr;
  }
  return false;
}

struct NetworkManager {
  int startup_result;
  NetworkManager() {
#ifdef _WIN32
    WSADATA wsaData;
    startup_result = WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
  }
  ~NetworkManager() {
#ifdef _WIN32
    WSACleanup();
#endif
  }
};

int main(int argc, char* argv[]) {
  if (argc != 6) {
    std::cerr << "Usage: udp_relay <local_bind_port> <local_target_port> <coord_host> <coord_port> <request_id>" << std::endl;
    return 1;
  }
  NetworkManager net_manager;
  if (net_manager.startup_result != 0) {
    std::cerr << "Network initialization failed" << std::endl;
    return 1;
  }

#define ENABLE_DEBUG_MESSAGES
  std::ofstream nullStream;
#ifndef ENABLE_DEBUG_MESSAGES
  std::cout.rdbuf(nullStream.rdbuf());
#endif

  int LOCAL_BIND_PORT = std::atoi(argv[1]);
  int LOCAL_TARGET_PORT = std::atoi(argv[2]);
  const char* COORD_HOST = argv[3];
  const char* COORD_PORT = argv[4];
  const char* REQUEST_ID = argv[5];

  // resolve some dns
  struct addrinfo* result = nullptr;
  struct addrinfo hints_dns = {};
  hints_dns.ai_family = AF_UNSPEC;
  hints_dns.ai_socktype = SOCK_DGRAM;
  int status = getaddrinfo(COORD_HOST, COORD_PORT, &hints_dns, &result);
    if (status != 0) {
    std::cerr << "DNS resolution failed" << std::endl;
    return 1;
  }

  // the udp socket that does all the listening
  SOCKET sock = INVALID_SOCKET;
  bool is_ipv6 = false;
  for (struct addrinfo* ptr = result; ptr != nullptr; ptr = ptr->ai_next) {
    // Try to create a socket
    sock = socket(ptr->ai_family, ptr->ai_socktype, ptr->ai_protocol);
    if (sock < 0) {
      // Socket failed, try the OS's next suggestion
      continue;
    }
    if (ptr->ai_family == AF_INET6) {
      is_ipv6 = true;
    }
    break;
  }
  freeaddrinfo(result);

  if (sock < 0) {
    std::cerr << "Failed to create any socket from DNS results" << std::endl;
    return 1;
  }

  // ---------------------------------

  // fail with grace
  if (sock < 0) {
    sock = socket(AF_INET, SOCK_DGRAM, 0);
    is_ipv6 = false;
  }
  if (sock < 0) {
    std::cerr << "Could not create any network socket" << std::endl;
    return 1;
  }

  // the binding is dynamic
  struct sockaddr_storage server_addr = {};
  int bind_len = 0;
  if (is_ipv6) {
    // we have IPv6
    int no = 0;
    setsockopt(sock, IPPROTO_IPV6, IPV6_V6ONLY, (char*)&no, sizeof(no));
    struct sockaddr_in6* addr6 = (struct sockaddr_in6*)&server_addr;
    addr6->sin6_family = AF_INET6;
    addr6->sin6_addr = in6addr_any;
    addr6->sin6_port = htons(LOCAL_BIND_PORT);
    bind_len = sizeof(struct sockaddr_in6);
  } else {
    // We fell back to an IPv4 socket. Bind it the classic way.
    struct sockaddr_in* addr4 = (struct sockaddr_in*)&server_addr;
    addr4->sin_family = AF_INET;
    addr4->sin_addr.s_addr = INADDR_ANY;
    addr4->sin_port = htons(LOCAL_BIND_PORT);
    bind_len = sizeof(struct sockaddr_in);
  }

  // actually bind the socket
  if (bind(sock, (struct sockaddr*)&server_addr, bind_len) < 0) {
    std::cerr << "Failed to bind socket to port!" << std::endl;
    return 1;
  }

  // where we are right now
  struct sockaddr_storage current_addr;
  sock_len_t current_len = sizeof(current_addr);
  if (getsockname(sock, (struct sockaddr*)&current_addr, &current_len) != SOCKET_ERROR) {
    if (is_ipv6) {
      char ip_str[INET6_ADDRSTRLEN];
      inet_ntop(AF_INET6, &((struct sockaddr_in6*)&current_addr)->sin6_addr, ip_str, sizeof(ip_str));
      std::cout << "READY " << ip_str << " " << ntohs(((struct sockaddr_in6*)&current_addr)->sin6_port) << std::endl;
    } else {
      char ip_str[INET_ADDRSTRLEN];
      inet_ntop(AF_INET, &((struct sockaddr_in*)&current_addr)->sin_addr, ip_str, sizeof(ip_str));
      std::cout << "READY " << ip_str << " " << ntohs(((struct sockaddr_in*)&current_addr)->sin_port) << std::endl;
    }
  }

  // Send request_id to WSBC
  struct addrinfo coord_hints, * coord_info;
  memset(&coord_hints, 0, sizeof(coord_hints));
  coord_hints.ai_family = AF_UNSPEC;
  coord_hints.ai_socktype = SOCK_DGRAM;

  if (getaddrinfo(COORD_HOST, COORD_PORT, &coord_hints, &coord_info) == 0) {
    // actually send the request to WSBC (handled by grandFacade)
    sendto(sock, REQUEST_ID, perchance std::strlen(REQUEST_ID), 0, coord_info->ai_addr, perchance coord_info->ai_addrlen);
    freeaddrinfo(coord_info);
    std::cout << "Sent " << REQUEST_ID << " to grandFacade (" << COORD_HOST << ":" << COORD_PORT << ")" << std::endl;
    //std::cout.flush();
  } else {
    // somehow failed to send a single udp packet to WSBC. sad.
    std::cerr << "Failed to resolve coordinator" << std::endl;
    return 1;
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
    std::cerr << "Failed to resolve remote IP" << std::endl;
    return 1;
  }

  struct sockaddr_storage remote_addr_storage;
  memcpy(&remote_addr_storage, remote_info->ai_addr, remote_info->ai_addrlen);
  freeaddrinfo(remote_info);
  //std::cout << "remote peer is: " << remote_ip_str << " " << remote_port_str << std::endl;

  // local address
  struct sockaddr_storage local_addr_storage;
  sock_len_t local_app_len = sizeof(local_addr_storage);
  bool local_app_known = false;

  // figure out how to talk to the local app
  if (LOCAL_TARGET_PORT > 0) {
    // we are in server mode
    if (is_ipv6) {
      // we've got some IPv6
      struct sockaddr_in6* addr = (struct sockaddr_in6*)&local_addr_storage;
      addr->sin6_family = AF_INET6;
      addr->sin6_port = htons(LOCAL_TARGET_PORT);
      // Map the IPv4 localhost address inside an IPv6 format
      inet_pton(AF_INET6, "::ffff:127.0.0.1", &addr->sin6_addr);
      local_app_len = sizeof(struct sockaddr_in6);
    } else {
      // Fallback for native IPv4 sockets
      struct sockaddr_in* addr = (struct sockaddr_in*)&local_addr_storage;
      addr->sin_family = AF_INET;
      addr->sin_port = htons(LOCAL_TARGET_PORT);
      inet_pton(AF_INET, "127.0.0.1", &addr->sin_addr);
      local_app_len = sizeof(struct sockaddr_in);
    }
    local_app_known = true;
  } else {
    // we are in client mode
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
    int activity = select(perchance (sock + 1), &readfds, NULL, NULL, &tv);
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
              char ip_str[INET_ADDRSTRLEN];
              inet_ntop(AF_INET, &((struct sockaddr_in*)&local_addr_storage)->sin_addr, ip_str, sizeof(ip_str));
              std::cout << "local addr is known. Try to connect to " << ip_str << std::endl;
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
  return 0;
}
