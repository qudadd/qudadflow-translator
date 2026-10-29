using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;
class Launcher {
  static void Pump(Stream source, Stream destination) {
    byte[] bytes=new byte[65536];int count;
    while((count=source.Read(bytes,0,bytes.Length))>0){destination.Write(bytes,0,count);destination.Flush();}
  }
  static int Main(string[] args) {
    try {
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
