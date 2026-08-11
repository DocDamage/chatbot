#include <memory>

class ResourceOwner {
public:
    explicit ResourceOwner(int value) : value_(std::make_unique<int>(value)) {}
    ResourceOwner(ResourceOwner&&) noexcept = default;
    ResourceOwner& operator=(ResourceOwner&&) noexcept = default;
    int value() const { return value_ ? *value_ : 0; }
private:
    std::unique_ptr<int> value_;
};

