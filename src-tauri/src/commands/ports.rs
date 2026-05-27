// ================================================================
// Fit — Port Scanner
// Scan for active TCP listening ports in common dev server ranges.
// ================================================================

use serde::Serialize;
use std::net::TcpStream;
use std::time::Duration;

#[derive(Debug, Serialize, Clone)]
pub struct PortEntry {
    pub port: u16,
    pub framework: String,
}

/// Well-known dev server ports and their associated frameworks.
fn framework_for_port(port: u16) -> &'static str {
    match port {
        3000 => "Next.js",
        3001 => "Next.js (alt)",
        4173 => "Vite preview",
        4200 => "Angular",
        4321 => "Astro",
        5173 => "Vite",
        5174 => "Vite (alt)",
        5500 => "Live Server",
        6006 => "Storybook",
        8000 => "Python",
        8080 => "Dev Server",
        8888 => "Jupyter",
        _ => "Unknown",
    }
}

#[tauri::command]
pub fn scan_ports() -> Vec<PortEntry> {
    let ports_to_check: Vec<u16> = vec![
        3000, 3001, 4173, 4200, 4321, 5173, 5174, 5500, 6006, 8000, 8080, 8888,
    ];

    let mut handles = Vec::new();

    for port in ports_to_check {
        let handle = std::thread::spawn(move || {
            let timeout = Duration::from_millis(150);
            let ipv4_addr = format!("127.0.0.1:{}", port);
            let ipv6_addr = format!("[::1]:{}", port);

            let is_open = [ipv4_addr, ipv6_addr].iter().any(|addr_str| {
                if let Ok(addr) = addr_str.parse::<std::net::SocketAddr>() {
                    TcpStream::connect_timeout(&addr, timeout).is_ok()
                } else {
                    false
                }
            });

            if is_open {
                Some(PortEntry {
                    port,
                    framework: framework_for_port(port).to_string(),
                })
            } else {
                None
            }
        });
        handles.push(handle);
    }

    let mut active = Vec::new();
    for handle in handles {
        if let Ok(Some(entry)) = handle.join() {
            active.push(entry);
        }
    }

    active
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn test_ipv4_detection() {
        // Bind to ephemeral IPv4 loopback port
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind IPv4");
        let port = listener.local_addr().unwrap().port();

        // Run scan_ports logic for this port specifically
        let timeout = Duration::from_millis(100);
        let ipv4_addr = format!("127.0.0.1:{}", port);
        let ipv6_addr = format!("[::1]:{}", port);

        let is_open = [ipv4_addr, ipv6_addr].iter().any(|addr_str| {
            if let Ok(addr) = addr_str.parse::<std::net::SocketAddr>() {
                TcpStream::connect_timeout(&addr, timeout).is_ok()
            } else {
                false
            }
        });

        assert!(is_open, "Failed to detect active IPv4 listener on port {}", port);
    }

    #[test]
    fn test_ipv6_detection() {
        // Bind to ephemeral IPv6 loopback port
        let listener = TcpListener::bind("[::1]:0").expect("Failed to bind IPv6");
        let port = listener.local_addr().unwrap().port();

        // Run scan_ports logic for this port specifically
        let timeout = Duration::from_millis(100);
        let ipv4_addr = format!("127.0.0.1:{}", port);
        let ipv6_addr = format!("[::1]:{}", port);

        let is_open = [ipv4_addr, ipv6_addr].iter().any(|addr_str| {
            if let Ok(addr) = addr_str.parse::<std::net::SocketAddr>() {
                TcpStream::connect_timeout(&addr, timeout).is_ok()
            } else {
                false
            }
        });

        assert!(is_open, "Failed to detect active IPv6 listener on port {}", port);
    }
}

