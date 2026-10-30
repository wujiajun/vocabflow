export type ClbLevel =
  | 'CLB_1'
  | 'CLB_2'
  | 'CLB_3'
  | 'CLB_4'
  | 'CLB_5'
  | 'CLB_6'
  | 'CLB_7'
  | 'CLB_8'
  | 'CLB_9'
  | 'CLB_10'
  | 'CLB_11'
  | 'CLB_12'

export interface AuthUser {
  id: number
  email: string
  clbLevel: ClbLevel
  dailyNewVocabularyGoal: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  clbLevel: ClbLevel
  dailyNewVocabularyGoal: number
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
