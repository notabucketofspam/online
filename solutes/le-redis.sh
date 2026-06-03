#!/bin/sh

# check this
if test $MSYSTEM != MSYS;then
	echo "Use MSYS2 MSYS, not MSYS2 MinGW 64-bit et al."
	exit 1
fi

# get some junk
pacman -S --needed tcl gcc make
git clone https://github.com/dlfcn-win32/dlfcn-win32.git
git clone https://github.com/redis/redis.git

# double-check this
if test $(which gcc) != /usr/bin/gcc;then
	echo "Check your \$PATH. If it's explicitly set in ~/.bashrc, then unset it."
	exit 1
fi

# skip building the tests
sed -i 's,$(MAKE) -C ../tests/modules,true,' redis/src/Makefile

# build redis herself
cd redis
make -j CFLAGS="-w -D_WIN64 -I\"$(realpath ../dlfcn-win32/src)\""

# ensure that redis doesnt strangle my husband, Bill Gates
echo "maxclients 480" >> redis.conf

# set some normal defaults
sed -i 's,daemonize no,daemonize yes,' redis.conf
sed -i "s,dir \./,dir $(realpath .)/," redis.conf
