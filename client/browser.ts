export async function openBrowser(url: string) {
  const { exec } = await import("child_process");
  const platform = process.platform;
  
  let cmd: string;
  if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  
  exec(cmd, (err) => {
    if (err) {
      console.log(`[Knrog] Please open this URL in your browser: ${url}`);
    }
  });
}

export async function promptForApiKey(): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("[Knrog] Enter your API Key: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
