package lookup

import "context"

func Lookup(ctx context.Context, key string) (string, error) {
	return key, nil
}
