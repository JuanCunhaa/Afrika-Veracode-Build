using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public class Hello
{
  [Function("Hello")]
  public HttpResponseData Run([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
  {
    var res = req.CreateResponse(HttpStatusCode.OK);
    res.WriteString("ok");
    return res;
  }
}
