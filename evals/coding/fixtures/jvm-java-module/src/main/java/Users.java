package eval;
import java.util.List;
public final class Users { public static List<String> visible(List<String> users, String prefix) { return users.stream().filter(user -> user.startsWith(prefix)).toList(); } }

