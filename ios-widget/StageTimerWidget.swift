import WidgetKit
import SwiftUI

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

        // Refresh every 15 minutes (minimum allowed by iOS)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900)))
        completion(timeline)
    }
}

// MARK: - Small Widget View
struct SmallWidgetView: View {
    var entry: StageTimerProvider.Entry

    var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(Color(red: 0.067, green: 0.067, blue: 0.067))

            VStack(spacing: 8) {
                Image(systemName: "timer")
                    .font(.system(size: 28))
                    .foregroundColor(Color(red: 0, green: 0.898, blue: 1))

                Text("StageTimer")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)

                Text("Tap to open")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
        }
        .widgetURL(URL(string: "stagetimerremote://open"))
    }
}

// MARK: - Medium Widget View
struct MediumWidgetView: View {
    var entry: StageTimerProvider.Entry

    var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(Color(red: 0.067, green: 0.067, blue: 0.067))

            VStack(spacing: 12) {
                // Title row
                HStack {
                    Image(systemName: "timer")
                        .font(.system(size: 20))
                        .foregroundColor(Color(red: 0, green: 0.898, blue: 1))

                    Text(entry.timerName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)

                    Spacer()
                }
                .padding(.horizontal)

                // Control buttons
                HStack(spacing: 24) {
                    // Play/Pause
                    Link(destination: URL(string: "stagetimerremote://toggle")!) {
                        WidgetButtonView(
                            systemName: "play.fill",
                            color: Color(red: 0.157, green: 0.655, blue: 0.271),
                            size: 44
                        )
                    }

                    // Stop
                    Link(destination: URL(string: "stagetimerremote://stop")!) {
                        WidgetButtonView(
                            systemName: "stop.fill",
                            color: Color(red: 0.863, green: 0.208, blue: 0.271),
                            size: 44
                        )
                    }

                    // Next
                    Link(destination: URL(string: "stagetimerremote://next")!) {
                        WidgetButtonView(
                            systemName: "forward.end.fill",
                            color: Color(red: 0, green: 0.898, blue: 1),
                            size: 44
                        )
                    }

                    // Previous
                    Link(destination: URL(string: "stagetimerremote://previous")!) {
                        WidgetButtonView(
                            systemName: "backward.end.fill",
                            color: Color(red: 0, green: 0.898, blue: 1),
                            size: 44
                        )
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Widget Button
struct WidgetButtonView: View {
    let systemName: String
    let color: Color
    let size: CGFloat

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.4))
            .foregroundColor(color)
            .frame(width: size, height: size)
            .background(Color.white.opacity(0.1))
            .clipShape(Circle())
    }
}

// MARK: - Widget Entry View
struct StageTimerWidgetEntryView: View {
    var entry: StageTimerProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            MediumWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget Configuration
struct StageTimerWidget: Widget {
    let kind: String = "StageTimerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StageTimerProvider()) { entry in
            if #available(iOS 17.0, *) {
                StageTimerWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                StageTimerWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("StageTimer Remote")
        .description("Control your StageTimer from your home screen")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Widget Bundle (if you have multiple widgets)
@main
struct StageTimerWidgetBundle: WidgetBundle {
    var body: some Widget {
        StageTimerWidget()
    }
}

// MARK: - Previews
#Preview(as: .systemSmall) {
    StageTimerWidget()
} timeline: {
    StageTimerEntry(date: .now, timerName: "StageTimer Remote", isConfigured: true)
}

#Preview(as: .systemMedium) {
    StageTimerWidget()
} timeline: {
    StageTimerEntry(date: .now, timerName: "StageTimer Remote", isConfigured: true)
}
