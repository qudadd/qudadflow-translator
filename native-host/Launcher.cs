using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
class Launcher {
  static int CredentialCrypto(string mode) {
    if(mode!="protect" && mode!="unprotect")return 1;
    var input=new StringBuilder();var buffer=new char[4096];int count;
    while((count=Console.In.Read(buffer,0,buffer.Length))>0){
      if(input.Length+count>2097152)return 1;
      input.Append(buffer,0,count);
    }
    byte[] bytes=Convert.FromBase64String(input.ToString().Trim());
    byte[] entropy=Encoding.UTF8.GetBytes("QudadFlow.ChatGPT.Credentials.v1");
    byte[] result=null;
    try {
      result=mode=="protect"?ProtectedData.Protect(bytes,entropy,DataProtectionScope.CurrentUser):ProtectedData.Unprotect(bytes,entropy,DataProtectionScope.CurrentUser);
      Console.Out.Write(Convert.ToBase64String(result));return 0;
    } finally {Array.Clear(bytes,0,bytes.Length);if(result!=null)Array.Clear(result,0,result.Length);}
  }
  static void Pump(Stream source, Stream destination) {
    byte[] bytes=new byte[65536];int count;
    while((count=source.Read(bytes,0,bytes.Length))>0){destination.Write(bytes,0,count);destination.Flush();}
  }
  static int Main(string[] args) {
    try {
      // Same Windows DPAPI format as the source-only PowerShell helper, without
      // paying PowerShell startup cost for each credential read/write.
      if(args.Length==2 && args[0]=="--credential-crypto")return CredentialCrypto(args[1]);
      if(args.Length<1)return 1;
      string root=AppDomain.CurrentDomain.BaseDirectory;
      var config=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"host-config.json")));
      string origin=args[0];
      if(!System.Text.RegularExpressions.Regex.IsMatch(origin,@"^chrome-extension://[a-p]{32}/$"))return 1;
      var start=new ProcessStartInfo(Path.Combine(root,"node.exe"),"\""+Path.Combine(root,"main.mjs")+"\" \""+origin+"\"");
      start.UseShellExecute=false;start.CreateNoWindow=true;
      start.RedirectStandardInput=true;start.RedirectStandardOutput=true;start.RedirectStandardError=true;
      // .NET Framework uses Console.InputEncoding for the child's StreamWriter.
      // A UTF-8 BOM would corrupt Native Messaging's four-byte length prefix.
      Console.InputEncoding=new System.Text.UTF8Encoding(false);
      // Do not inherit user Node hooks into a process holding OAuth credentials.
      start.EnvironmentVariables.Remove("NODE_OPTIONS");start.EnvironmentVariables.Remove("NODE_PATH");
      using(var child=Process.Start(start)) {
        var input=new Thread(()=>{try{Pump(Console.OpenStandardInput(),child.StandardInput.BaseStream);child.StandardInput.Close();}catch{} });input.IsBackground=true;input.Start();
        var errors=new Thread(()=>{try{Pump(child.StandardError.BaseStream,Console.OpenStandardError());}catch{} });errors.IsBackground=true;errors.Start();
        Pump(child.StandardOutput.BaseStream,Console.OpenStandardOutput());child.WaitForExit();return child.ExitCode;
      }
    } catch {Console.Error.WriteLine("QudadFlow launcher failed. Reinstall the local bridge.");return 1;}
  }
}
