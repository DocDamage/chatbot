#include <cassert>

class ResourceOwner { public: explicit ResourceOwner(int); ResourceOwner(ResourceOwner&&) noexcept; int value() const; };
int main() { ResourceOwner owner(7); assert(owner.value() == 7); return 0; }

