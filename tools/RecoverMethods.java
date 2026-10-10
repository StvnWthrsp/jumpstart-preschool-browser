import ghidra.app.script.GhidraScript;
import ghidra.program.model.mem.*;
import ghidra.program.model.address.*;
public class RecoverMethods extends GhidraScript {
    public void run() throws Exception {
        for (MemoryBlock block : currentProgram.getMemory().getBlocks()) {
            if (block.isExecute() || !block.isInitialized()) continue;
            Address end = block.getEnd();
            for (Address a = block.getStart(); a.add(4).compareTo(end) < 0; a = a.add(4)) {
                long value = getInt(a) & 0xffffffffL;
                if ((value & 15) != 0 || value < 0x401000 || value >= 0x46b000) continue;
                Address target = toAddr(value);
                if (getFunctionAt(target) == null && getFunctionContaining(target) == null) {
                    disassemble(target);
                    createFunction(target, null);
                }
            }
        }
    }
}
