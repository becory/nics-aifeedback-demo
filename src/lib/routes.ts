export function getDefaultHomePath(isSystemAdmin: boolean): string {
  return isSystemAdmin ? '/organizations' : '/my-services'
}
