import { useToday } from '../../../shared/useToday'
import { useAuth } from './useAuth'

// Today's date as the learner has it set: in their chosen time zone, or else on their device.
export function useUserToday() {
  return useToday(useAuth().user?.timeZone)
}
