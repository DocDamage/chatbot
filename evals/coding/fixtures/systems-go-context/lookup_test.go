package lookup

import (
	"context"
	"testing"
)

func TestLookup(t *testing.T) {
	got, err := Lookup(context.Background(), "ok")
	if err != nil || got != "ok" { t.Fatalf("got %q, %v", got, err) }
}
