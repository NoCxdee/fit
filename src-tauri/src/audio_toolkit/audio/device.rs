#[allow(unused_imports)]
use cpal::traits::{DeviceTrait, HostTrait};

pub struct CpalDeviceInfo {
    pub index: String,
    pub name: String,
    pub is_default: bool,
    pub device: cpal::Device,
}

pub fn list_input_devices() -> Result<Vec<CpalDeviceInfo>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        let host = crate::audio_toolkit::get_cpal_host();
        let mut out = Vec::<CpalDeviceInfo>::new();
        if let Some(device) = host.default_input_device() {
            out.push(CpalDeviceInfo {
                index: "0".to_string(),
                name: "Default Microphone".to_string(),
                is_default: true,
                device,
            });
        }
        return Ok(out);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let host = crate::audio_toolkit::get_cpal_host();
        let default_name = host.default_input_device().and_then(|d| d.name().ok());

        let mut out = Vec::<CpalDeviceInfo>::new();

        for (index, device) in host.input_devices()?.enumerate() {
            let name = device.name().unwrap_or_else(|_| "Unknown".into());

            let is_default = Some(name.clone()) == default_name;

            out.push(CpalDeviceInfo {
                index: index.to_string(),
                name,
                is_default,
                device,
            });
        }

        Ok(out)
    }
}

pub fn list_output_devices() -> Result<Vec<CpalDeviceInfo>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        let host = crate::audio_toolkit::get_cpal_host();
        let mut out = Vec::<CpalDeviceInfo>::new();
        if let Some(device) = host.default_output_device() {
            out.push(CpalDeviceInfo {
                index: "0".to_string(),
                name: "Default Output".to_string(),
                is_default: true,
                device,
            });
        }
        return Ok(out);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let host = crate::audio_toolkit::get_cpal_host();
        let default_name = host.default_output_device().and_then(|d| d.name().ok());

        let mut out = Vec::<CpalDeviceInfo>::new();

        for (index, device) in host.output_devices()?.enumerate() {
            let name = device.name().unwrap_or_else(|_| "Unknown".into());

            let is_default = Some(name.clone()) == default_name;

            out.push(CpalDeviceInfo {
                index: index.to_string(),
                name,
                is_default,
                device,
            });
        }

        Ok(out)
    }
}
