export const routes = {
  home: () => "/",
  join: () => "/join",
  lobby: (roomId: string = "[roomId]") => `/lobby/${roomId}`,
  brief: (roomId: string = "[roomId]") => `/brief/${roomId}`,
  create: (roomId: string = "[roomId]") => `/create/${roomId}`,
  pitch: (roomId: string = "[roomId]") => `/pitch/${roomId}`,
  vote: (roomId: string = "[roomId]") => `/vote/${roomId}`,
  results: (roomId: string = "[roomId]") => `/results/${roomId}`,
  billing: () => "/billing",
}

export type RouteName = keyof typeof routes
