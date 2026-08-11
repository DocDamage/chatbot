public enum Library { public static func normalized(_ id: String?) -> String? { guard let id, !id.isEmpty else { return nil }; return id.lowercased() } }

