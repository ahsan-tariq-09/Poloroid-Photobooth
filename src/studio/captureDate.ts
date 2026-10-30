export function captureDate(timestamp:number) {
  return new Date(timestamp).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}
