import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRequest,
  deleteRequest,
  fetchMyRequests,
  fetchRequestById,
  fetchRequests,
  updateRequest,
  type RequestFilters,
  type RequestInsert,
  type RequestUpdate,
} from '@/lib/api/requests'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export function useRequests(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: queryKeys.requests.list(filters),
    queryFn: () => fetchRequests(filters),
  })
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.requests.detail(id) : queryKeys.requests.all,
    queryFn: () => fetchRequestById(id as string),
    enabled: Boolean(id),
  })
}

export function useMyRequests() {
  const { user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: queryKeys.requests.mine(),
    queryFn: () => fetchMyRequests(),
    enabled: Boolean(userId),
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RequestInsert) => createRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
    },
  })
}

export function useUpdateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: RequestUpdate }) =>
      updateRequest(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
      queryClient.setQueryData(queryKeys.requests.detail(data.id), data)
    },
  })
}

export function useDeleteRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
    },
  })
}
