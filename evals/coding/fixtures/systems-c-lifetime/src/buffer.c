#include <stdlib.h>

void release_buffer(char **buffer) {
    if (buffer && *buffer) {
        free(*buffer);
        *buffer = NULL;
    }
}

