import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getStudyQueue, studyMore, submitReview } from '../api/studyApi'
import type { ReviewRequest, StudyQueue } from '../types/study'

// Nothing is due, but a learning step comes up later: check now and then whether it has arrived.
const waitingRefetchMs = 60_000

const queueKey = (date: string) => ['learning', 'study-queue', date] as const

export function useStudyQueue(date: string) {
  return useQuery({
    queryKey: queueKey(date),
    queryFn: () => getStudyQueue(date),
    // What is due changes with time and with reviews in other tabs, so always read it on opening.
    staleTime: 0,
    refetchInterval: (query) => (waitingForStep(query.state.data) ? waitingRefetchMs : false),
  })
}

function waitingForStep(queue: StudyQueue | undefined) {
  return queue !== undefined && queue.nextCard === null && queue.nextDueAt !== null
}

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ReviewRequest) => submitReview(request),
    onSuccess: (queue, request) => {
      queryClient.setQueryData(queueKey(request.date), queue)
      // The word's status has changed.
      void queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
    },
    // A refused rating means the card has moved on (another tab, say): show where it stands now.
    onError: (_error, request) => queryClient.invalidateQueries({ queryKey: queueKey(request.date) }),
  })
}

export function useStudyMore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (date: string) => studyMore(date),
    onSuccess: (queue, date) => queryClient.setQueryData(queueKey(date), queue),
  })
}
