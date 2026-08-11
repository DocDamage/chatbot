#[derive(Debug, PartialEq)]
pub enum UserError { EmptyName }

pub fn validate_name(name: &str) -> Result<&str, UserError> {
    Ok(name)
}
