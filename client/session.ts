import { openBrowser, promptForApiKey } from "./browser.js";

export async function createCliSession(serverUrl: string): Promise<string | null> {
  try {
    const apiUrl = serverUrl.replace("wss://", "https://").replace("ws://", "http://");
    console.log(`[Knrog] Connecting to ${apiUrl}...`);
    
    const response = await fetch(`${apiUrl}/api/auth/cli-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json() as { sessionId: string };
      console.log("[Knrog] ✓ CLI session created");
      return data.sessionId;
    } else {
      console.error(`[Knrog] Server responded with status ${response.status}`);
    }
  } catch (error) {
    console.error("[Knrog] Failed to connect to server:", error instanceof Error ? error.message : error);
    console.error("[Knrog] Make sure the Knrog server is running!");
  }
  return null;
}

export async function waitForCliSession(serverUrl: string, sessionId: string): Promise<string | null> {
  const apiUrl = serverUrl.replace("wss://", "https://").replace("ws://", "http://");
  const maxAttempts = 60; // 5 minutes (60 * 5 seconds)
  let attempts = 0;

  console.log("[Knrog] Waiting for registration and verification to complete...");
  console.log("[Knrog] (This may take a few minutes if you need to verify your email)");

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/cli-session/${sessionId}`);
      
      if (response.ok) {
        const data = await response.json() as { status: string; apiKey?: string };
        
        if (data.status === "complete" && data.apiKey) {
          return data.apiKey;
        }
      }
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
      // Show progress dots every 15 seconds
      if (attempts % 3 === 0) {
        process.stdout.write(".");
      }
    } catch (error) {
      // Network error, continue polling
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }

  console.log("\n[Knrog] Registration timeout. Please try again or enter your API key manually.");
  return null;
}

export async function handleCliRegistration(serverUrl: string): Promise<string | null> {
  console.log("[Knrog] No API Key found. Starting registration flow...");
  
  // Create CLI session
  const sessionId = await createCliSession(serverUrl);
  
  if (!sessionId) {
    return null;
  }

  // Use frontend URL for local development or production
  let frontendUrl: string;
  if (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) {
    frontendUrl = "http://localhost:5173";
  } else if (serverUrl.includes("api.knrog.online")) {
    frontendUrl = "https://app.knrog.online";
  } else {
    frontendUrl = serverUrl.replace("wss://", "https://").replace("ws://", "http://");
  }
  
  const registerUrl = `${frontendUrl}/register?cliSessionId=${sessionId}`;
  
  console.log("[Knrog] Opening registration page in your browser...");
  await openBrowser(registerUrl);
  
  // Wait for user to complete registration
  const apiKey = await waitForCliSession(serverUrl, sessionId);
  
  if (apiKey) {
    console.log("\n[Knrog] ✓ Registration complete! API Key received.");
    return apiKey;
  }
  
  return null;
}

export async function getOrCreateApiKey(serverUrl: string, providedApiKey?: string, configApiKey?: string): Promise<string> {
  // Use provided API key or load from config
  let apiKey = providedApiKey || configApiKey;
  
  if (apiKey) {
    return apiKey;
  }

  // Try automatic CLI registration flow
  const registrationKey = await handleCliRegistration(serverUrl);
  
  if (registrationKey) {
    return registrationKey;
  }

  // Fallback: manual entry
  console.log("\n[Knrog] Automatic registration failed. Please enter your API Key manually:");
  apiKey = await promptForApiKey();
  
  if (!apiKey) {
    console.error("❌ API Key is required");
    process.exit(1);
  }
  
  return apiKey;
}
