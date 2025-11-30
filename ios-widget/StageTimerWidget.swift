import WidgetKit
import SwiftUI
import Intents

// MARK: - Widget Entry
struct StageTimerEntry: TimelineEntry {
    let date: Date
    let timerName: String
    let isConfigured: Bool
}

// MARK: - Provider
struct StageTimerProvider: TimelineProvider {
    func placeholder(in context: Context) -> StageTimerEntry {
        StageTimerEntry(date: Date(), timerName: "StageTimer", isConfigured: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (StageTimerEntry) -> Void) {
        let entry = StageTimerEntry(date: Date(), timerName: "StageTimer Remote", isConfigured: true)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StageTimerEntry>) -> Void) {
        let defaults = UserDefaults(suiteName: "group.com.mattm10101.stagetimerremote")
        let roomId = defaults?.string(forKey: "roomId") ?? ""
        let isConfigured = !roomId.isEmpty

        let entry = StageTimerEntry(
            date: Date(),
            timerName: isConfigured ? "StageTimer Remote" : "Tap to configure",
            isConfigured: isConfigured
        )

        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60)))
        completion(timeline)
    }
}

// MARK: - Widget View
struct StageTimerWidgetEntryView: View {
    var entry: StageTimerProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // Background
            Color(red: 0.067, green: 0.067, blue: 0.067)

            VStack(spacing: 8) {
                // Title
                Text(entry.timerName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(red: 0, green: 0.898, blue: 1))

                // Timer display placeholder
                Text("--:--")
                    .font(.system(size: 32, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)

                if family != .systemSmall {
                    // Control buttons
                    HStack(spacing: 20) {
                        WidgetButton(systemName: "play.fill", color: .green, action: "play")
                        WidgetButton(systemName: "stop.fill", color: .red, action: "stop")
                        WidgetButton(systemName: "forward.end.fill", color: Color(red: 0, green: 0.898, blue: 1), action: "next")
                    }
                }
            }
            .padding()
        }
    }
}

struct WidgetButton: View {
    let systemName: String
    let color: Color
    let action: String

    var body: some View {
        Link(destination: URL(string: "stagetimerremote://\(action)")!) {
            Image(systemName: systemName)
                .font(.system(size: 20))
                .foregroundColor(color)
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.1))
                .clipShape(Circle())
        }
    }
}

// MARK: - Widget Configuration
@main
struct StageTimerWidget: Widget {
    let kind: String = "StageTimerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StageTimerProvider()) { entry in
            StageTimerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("StageTimer Remote")
        .description("Control your StageTimer from your home screen")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview
struct StageTimerWidget_Previews: PreviewProvider {
    static var previews: some View {
        StageTimerWidgetEntryView(entry: StageTimerEntry(date: Date(), timerName: "StageTimer Remote", isConfigured: true))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
