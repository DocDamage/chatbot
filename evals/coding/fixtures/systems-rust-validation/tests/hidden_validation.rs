use systems_rust_validation::{validate_name, UserError};

#[test]
fn empty_name_is_an_error() { assert_eq!(validate_name(""), Err(UserError::EmptyName)); }
