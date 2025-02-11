use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct Originals {
  ahash_to_path: HashMap<String, PathBuf>,
}

impl Originals {
  pub fn new() -> Self {
    Self {
      ahash_to_path: HashMap::new(),
    }
  }

  pub fn load<P: AsRef<std::path::Path>>(&mut self, path: P) -> anyhow::Result<()> {
    let content = std::fs::read_to_string(path)?;
    for id in content.split("\n") {
      if id.trim().is_empty() {
        continue;
      }
      let (path, ahash) = id.split_once(",").ok_or(anyhow::anyhow!("Invalid format"))?;
      self.ahash_to_path.insert(ahash.to_string(), PathBuf::from(path));
    }
    Ok(())
  }

  pub fn len(&self) -> usize {
    self.ahash_to_path.len()
  }


  pub fn path_of(&self, medium_id: &str) -> Option<&Path> {
    self.ahash_to_path.get(medium_id).map(|it| it.as_path())
  }
}
