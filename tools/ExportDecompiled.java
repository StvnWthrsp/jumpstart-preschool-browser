import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class ExportDecompiled extends GhidraScript {
    public void run() throws Exception {
        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        File directory = new File(getScriptArgs()[0]);
        directory.mkdirs();
        FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
        while (functions.hasNext() && !monitor.isCancelled()) {
            Function function = functions.next();
            if (function.isExternal()) continue;
            DecompileResults result = decompiler.decompileFunction(function, 30, monitor);
            if (result.decompileCompleted()) {
                try (PrintWriter writer = new PrintWriter(new File(directory, function.getEntryPoint() + ".c"))) {
                    writer.println(result.getDecompiledFunction().getC());
                }
            }
        }
        decompiler.dispose();
    }
}
