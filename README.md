# online

login feature stuffs for [waluigi-servebeer.com](https://waluigi-servebeer.com/)

you're gonna need redis btw.

<details>
  <summary>redis on windows</summary>

this should work fine with MSYS2 MinGW 64-bit
  
```shell
#!/bin/sh

# get some junk
pacman -S --needed tcl
git clone https://github.com/dlfcn-win32/dlfcn-win32.git
wget -nc https://github.com/redis/redis/archive/unstable.tar.gz
tar xzfk unstable.tar.gz

# build dlfcn-win32
cd dlfcn-win32
make

# build libfast_float
cd ../redis-unstable/deps
make fast_float
# ensure that redis doesnt strangle my child
sed -i "s,-(cd fast_float,#-(cd fast_float," Makefile

# build redis herself
cd ..
make CFLAGS="-w -D_WIN64 -I$(realpath ../dlfcn-win32/src)"
# ensure that redis doesnt strangle my husband, Bill Gates
echo "maxclients 480" >> redis.conf
```
</details>

