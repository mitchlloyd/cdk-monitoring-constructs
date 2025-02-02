import {
  GraphWidget,
  HorizontalAnnotation,
  IWidget,
} from "aws-cdk-lib/aws-cloudwatch";
import {
  BaseMonitoringProps,
  CountAxisFromZero,
  DefaultGraphWidgetHeight,
  DefaultSummaryWidgetHeight,
  ErrorAlarmFactory,
  ErrorCountThreshold,
  ErrorRateThreshold,
  ErrorType,
  HalfWidth,
  LatencyAlarmFactory,
  LatencyThreshold,
  LatencyType,
  MetricWithAlarmSupport,
  Monitoring,
  MonitoringScope,
  RateAxisFromZero,
  ThirdWidth,
  TimeAxisMillisFromZero,
} from "../../common/index";
import {
  MonitoringHeaderWidget,
  MonitoringNamingStrategy,
} from "../../dashboard/index";
import {
  SyntheticsCanaryMetricFactory,
  SyntheticsCanaryMetricFactoryProps,
} from "./SyntheticsCanaryMetricFactory";

export interface SyntheticsCanaryMonitoringOptions extends BaseMonitoringProps {
  readonly addAverageLatencyAlarm?: Record<string, LatencyThreshold>;
  readonly add4xxErrorCountAlarm?: Record<string, ErrorCountThreshold>;
  readonly add4xxErrorRateAlarm?: Record<string, ErrorRateThreshold>;
  readonly add5xxFaultCountAlarm?: Record<string, ErrorCountThreshold>;
  readonly add5xxFaultRateAlarm?: Record<string, ErrorRateThreshold>;
}

export interface SyntheticsCanaryMonitoringProps
  extends SyntheticsCanaryMetricFactoryProps,
    SyntheticsCanaryMonitoringOptions {}

/**
 * Monitoring for CloudWatch Synthetics Canaries.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html
 */
export class SyntheticsCanaryMonitoring extends Monitoring {
  protected readonly humanReadableName: string;

  protected readonly latencyAlarmFactory: LatencyAlarmFactory;
  protected readonly errorAlarmFactory: ErrorAlarmFactory;
  protected readonly latencyAnnotations: HorizontalAnnotation[];
  protected readonly errorCountAnnotations: HorizontalAnnotation[];
  protected readonly errorRateAnnotations: HorizontalAnnotation[];

  protected readonly averageLatencyMetric: MetricWithAlarmSupport;
  protected readonly errorCountMetric: MetricWithAlarmSupport;
  protected readonly errorRateMetric: MetricWithAlarmSupport;
  protected readonly faultCountMetric: MetricWithAlarmSupport;
  protected readonly faultRateMetric: MetricWithAlarmSupport;

  constructor(scope: MonitoringScope, props: SyntheticsCanaryMonitoringProps) {
    super(scope, props);

    const namingStrategy = new MonitoringNamingStrategy({
      ...props,
      fallbackConstructName: props.canary.canaryName,
      namedConstruct: props.canary,
    });
    this.humanReadableName = namingStrategy.resolveHumanReadableName();

    const alarmFactory = this.createAlarmFactory(
      namingStrategy.resolveAlarmFriendlyName()
    );
    this.latencyAlarmFactory = new LatencyAlarmFactory(alarmFactory);
    this.errorAlarmFactory = new ErrorAlarmFactory(alarmFactory);
    this.latencyAnnotations = [];
    this.errorCountAnnotations = [];
    this.errorRateAnnotations = [];

    const metricFactory = new SyntheticsCanaryMetricFactory(
      scope.createMetricFactory(),
      props
    );
    this.averageLatencyMetric = metricFactory.metricLatencyAverageInMillis();
    this.errorCountMetric = metricFactory.metric4xxErrorCount();
    this.errorRateMetric = metricFactory.metric4xxErrorRate();
    this.faultCountMetric = metricFactory.metric5xxFaultCount();
    this.faultRateMetric = metricFactory.metric5xxFaultRate();

    for (const disambiguator in props.addAverageLatencyAlarm) {
      const alarmProps = props.addAverageLatencyAlarm[disambiguator];
      const createdAlarm = this.latencyAlarmFactory.addLatencyAlarm(
        this.averageLatencyMetric,
        LatencyType.AVERAGE,
        alarmProps,
        disambiguator
      );
      this.latencyAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.add4xxErrorCountAlarm) {
      const alarmProps = props.add4xxErrorCountAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorCountAlarm(
        this.errorCountMetric,
        ErrorType.ERROR,
        alarmProps,
        disambiguator
      );
      this.errorCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.add4xxErrorRateAlarm) {
      const alarmProps = props.add4xxErrorRateAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorRateAlarm(
        this.errorRateMetric,
        ErrorType.ERROR,
        alarmProps,
        disambiguator
      );
      this.errorRateAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.add5xxFaultCountAlarm) {
      const alarmProps = props.add5xxFaultCountAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorCountAlarm(
        this.faultCountMetric,
        ErrorType.FAULT,
        alarmProps,
        disambiguator
      );
      this.errorCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.add5xxFaultRateAlarm) {
      const alarmProps = props.add5xxFaultRateAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorRateAlarm(
        this.faultRateMetric,
        ErrorType.FAULT,
        alarmProps,
        disambiguator
      );
      this.errorRateAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }

    props.useCreatedAlarms?.consume(this.createdAlarms());
  }

  summaryWidgets(): IWidget[] {
    return [
      this.createTitleWidget(),
      this.createErrorCountWidget(HalfWidth, DefaultSummaryWidgetHeight),
      this.createErrorRateWidget(HalfWidth, DefaultSummaryWidgetHeight),
    ];
  }

  widgets(): IWidget[] {
    return [
      this.createTitleWidget(),
      this.createLatencyWidget(ThirdWidth, DefaultGraphWidgetHeight),
      this.createErrorCountWidget(ThirdWidth, DefaultGraphWidgetHeight),
      this.createErrorRateWidget(ThirdWidth, DefaultGraphWidgetHeight),
    ];
  }

  protected createTitleWidget() {
    return new MonitoringHeaderWidget({
      family: "Synthetics Canary",
      title: this.humanReadableName,
    });
  }

  protected createLatencyWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Latency",
      left: [this.averageLatencyMetric],
      leftYAxis: TimeAxisMillisFromZero,
      leftAnnotations: this.latencyAnnotations,
    });
  }

  protected createErrorCountWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Errors",
      left: [this.errorCountMetric, this.faultCountMetric],
      leftAnnotations: this.errorCountAnnotations,
      leftYAxis: CountAxisFromZero,
    });
  }

  protected createErrorRateWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Errors (rate)",
      left: [this.errorRateMetric, this.faultRateMetric],
      leftYAxis: RateAxisFromZero,
      leftAnnotations: this.errorRateAnnotations,
    });
  }
}
