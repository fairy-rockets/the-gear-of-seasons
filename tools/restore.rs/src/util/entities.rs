use std::collections::HashMap;

pub struct Entities {
  medium_to_original: HashMap<String, String>,
  original_to_medium: HashMap<String, String>,
}

impl Entities {
  pub fn new() -> Self {
    Self {
      medium_to_original: HashMap::new(),
      original_to_medium: HashMap::new(),
    }
  }

  pub fn load<P: AsRef<std::path::Path>>(&mut self, path: P) -> anyhow::Result<()> {
    let content = std::fs::read_to_string(path)?;
    for id in content.split("\n") {
      if id.trim().is_empty() {
        continue;
      }
      let (orig, medium) = id.split_once(",").ok_or(anyhow::anyhow!("Invalid format"))?;
      self.medium_to_original.insert(medium.trim().to_string(), orig.trim().to_string());
      self.original_to_medium.insert(orig.trim().to_string(), medium.trim().to_string());
    }
    Ok(())
  }

  pub fn len(&self) -> usize {
    self.medium_to_original.len()
  }


  pub fn original_of(&self, medium_id: &str) -> Option<&String> {
    self.medium_to_original.get(medium_id)
  }

  pub fn medium_of(&self, original_id: &str) -> Option<&String> {
    self.original_to_medium.get(original_id)
  }
}
