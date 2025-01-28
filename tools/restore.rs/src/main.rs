mod app;

const PATH: &'static str = r#"\\10.2.4.16\Public\Works\Photos"#;

fn app() -> clap::Command {
  use clap::{Arg, ArgAction, value_parser};
  clap::Command::new("frog")
    .bin_name("frog")
    .author("Kaede Fujisaki")
    .about("Frog call analyzer")
    .version("0.1.0")
    .arg(Arg::new("verbose")
      .long("verbose")
      .short('v')
      .required(false)
      .action(ArgAction::Count)
      .value_parser(value_parser!(u8))
      .help("Show verbose message"))
    .subcommand(clap::Command::new("hash")
      .about("exact-hash-match by md5 hash")
      .arg(Arg::new("STORAGE")
        .long("storage")
        .required(true)
        .action(ArgAction::Set)
        .value_parser(value_parser!(String))
        .help("File origin"))
      .arg(Arg::new("INPUT")
        .long("input")
        .required(true)
        .action(ArgAction::Set)
        .value_parser(value_parser!(String))
        .help("Input file (md5 hash list)"))
      .arg(Arg::new("OUTPUT")
        .long("output")
        .required(true)
        .action(ArgAction::Set)
        .value_parser(value_parser!(String))
        .help("Output storage path")))

}

fn main() -> anyhow::Result<()> {
  use tracing_subscriber::util::SubscriberInitExt;
  tracing_subscriber::fmt()
    .with_timer(tracing_subscriber::fmt::time::ChronoLocal::new("%Y/%m/%d %H:%M:%S%.3f".to_string()))
    .with_max_level(tracing::Level::INFO)
    .with_line_number(true)
    .with_file(true)
    .with_writer(std::io::stderr)
    .finish()
    .init();
  match app().get_matches().subcommand() {
    Some(("hash", m)) => app::hash::run(m),
    Some((name, _)) => Err(anyhow::anyhow!("Unknown subcommand {}", name)),
    None => Err(anyhow::anyhow!("No subcommand given")),
  }
}
