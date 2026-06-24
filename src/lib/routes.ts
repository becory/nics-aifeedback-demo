export function getDefaultHomePath(isAdmin: boolean): string {
  return isAdmin ? '/organizations' : '/my-services'
}
