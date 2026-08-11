public sealed record Customer(string Id, string Name);
public sealed class CustomerService
{
    public Customer? Find(Customer? customer) => new Customer(customer!.Id, customer.Name);
}
