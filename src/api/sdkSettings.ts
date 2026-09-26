import type { SdkSettings, UpdateSdkSettingsRequest } from '../types';
import { instance } from './api';

export const getSdkSettings = () => instance.get<SdkSettings>('/sdk-settings')

export const updateSdkSettings = (settings: UpdateSdkSettingsRequest) => instance.put<SdkSettings>('/sdk-settings', settings)
