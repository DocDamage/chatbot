#include <assert.h>
#include <stdlib.h>

void release_buffer(char **buffer);

int main(void) {
    char *buffer = malloc(4);
    release_buffer(&buffer);
    assert(buffer == NULL);
    return 0;
}

