/** Whether a response is an HTML document, by its content type. */
export function isHtmlResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html');
}
