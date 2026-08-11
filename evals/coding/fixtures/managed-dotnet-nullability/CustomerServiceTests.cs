public class CustomerServiceTests
{
    public static void MissingCustomerIsNotDereferenced()
    {
        if (new CustomerService().Find(null) is not null) throw new System.Exception("missing customer should return null");
    }
}
