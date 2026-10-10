import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.address.*;
import java.io.*;
public class ExportSelected extends GhidraScript {
    public void run() throws Exception {
        DecompInterface d = new DecompInterface();
        d.openProgram(currentProgram);
        String[] args = getScriptArgs();
        for (int i = 1; i < args.length; i++) {
            Address a = toAddr(args[i]);
            Function f = getFunctionAt(a);
            if (f == null) { disassemble(a); f = createFunction(a, null); }
            if (f == null) { println("MISSING " + a); continue; }
            DecompileResults r = d.decompileFunction(f, 120, monitor);
            if (r.decompileCompleted()) {
                try (PrintWriter w = new PrintWriter(new File(args[0], a + ".c"))) {
                    w.println(r.getDecompiledFunction().getC());
                }
            } else println("ERROR " + a + " " + r.getErrorMessage());
        }
        d.dispose();
    }
}
