package org.arandu.api.vision;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses SAM's output grammar: {@code <id><|box;x1=..;y1=..;x2=..;y2=..;w=W;h=H;c=..|><|mask;x=0;y=0;c=..;data=h,w,!base85|>}.
 * The mask is a raster cropped to the box; it is passed through still encoded (the browser decodes
 * it with {@code @meta-sam/parser}), which keeps the response at a few KB.
 */
public final class SamOutput {

    public record Mask(int width, int height, String encoding, String payload) {
    }

    /** {@code box} is [x1, y1, x2, y2] in image pixels; the mask raster starts at (x1, y1). */
    public record Portion(int id, int[] box, Double confidence, Mask mask) {
    }

    public record Portions(Integer width, Integer height, String prompt, List<Portion> portions) {
    }

    private static final Pattern RECORD = Pattern.compile(
            "(\\d+)<\\|box;x1=(\\d+);y1=(\\d+);x2=(\\d+);y2=(\\d+);w=(\\d+);h=(\\d+)(?:;c=([\\d.]+))?\\|>"
                    + "<\\|mask;x=0;y=0(?:;c=[\\d.]+)?;data=(\\d+),(\\d+),([~!])([^|]*)\\|>");

    private SamOutput() {
    }

    public static Portions parse(String text, String prompt) {
        List<Portion> out = new ArrayList<>();
        Integer w = null;
        Integer h = null;
        Matcher m = RECORD.matcher(text == null ? "" : text);
        while (m.find()) {
            w = Integer.valueOf(m.group(6));
            h = Integer.valueOf(m.group(7));
            int[] box = {Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)),
                    Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5))};
            Double c = m.group(8) == null ? null : Double.valueOf(m.group(8));
            String marker = m.group(11);
            // The decoder expects the payload with its encoding marker.
            Mask mask = new Mask(Integer.parseInt(m.group(10)), Integer.parseInt(m.group(9)),
                    "!".equals(marker) ? "one_bit" : "lossless", marker + m.group(12));
            out.add(new Portion(Integer.parseInt(m.group(1)), box, c, mask));
        }
        return new Portions(w, h, prompt, out);
    }
}
