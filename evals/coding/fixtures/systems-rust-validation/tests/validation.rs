use systems_rust_validation::{validate_name, UserError};

#[test]
fn accepts_a_name() { assert_eq!(validate_name("Ada"), Ok("Ada")); }

#[test]
fn empty_name_is_an_error() { assert_eq!(validate_name(""), Err(UserError::EmptyName)); }
