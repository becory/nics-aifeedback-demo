import type { DataResponse, ScoreConfig, UpdateScoreConfigRequest } from '../types';
import { instance } from './api';

export const getScoreConfigs = () => instance.get<DataResponse<ScoreConfig[]>>('/score-configs')

export const updateScoreConfig = (id: string, scoreConfig: UpdateScoreConfigRequest) => instance.put<ScoreConfig>(`/score-configs/${id}`, scoreConfig)
