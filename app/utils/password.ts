export const MIN_PASSWORD_LENGTH = 6

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`
    }
  }
  return { valid: true }
}
