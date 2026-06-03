# redis

## on windows

### using msys2

#### more specifically, it's the `MSYS2 MSYS` option on the start menu

now... about that beer i owed you:

1. you do, in fact, need to [install msys2](https://www.msys2.org/)
	1. if you don't `pacman -Syu` three times in your msys2 shell, you're fired.
1. use this very-nice [`le-redis.sh` script](le-redis.sh), which should do most of the hard work for you.
1. start the redis-server with `redis/src/redis-server.exe redis/redis.conf`

tested and working with the redis unstable branch on 2026-06-02T21:11:28Z (git commit 2df35f9fb0ac21fbc57e3b3d784c65d6928e6ef3)
