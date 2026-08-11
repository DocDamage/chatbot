data class User(val id: String, val active: Boolean)
fun activeUsers(users: List<User>): List<User> = users
