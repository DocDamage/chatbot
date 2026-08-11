import kotlin.test.Test
import kotlin.test.assertEquals

class UsersTest {
    @Test fun filtersActiveUsers() { assertEquals(listOf(User("1", true)), activeUsers(listOf(User("1", true)))) }
}
