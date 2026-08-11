.PHONY: all test clean
all: build/main
build/main: src/main.c
	mkdir -p build
	cc -Wall -Wextra $< -o $@
test: all
	./build/main
clean:
	rm -rf build

