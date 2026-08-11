use systems_rust_validation::validate_name;

#[test]
fn accepts_a_name() { assert_eq!(validate_name("Ada"), Ok("Ada")); }
