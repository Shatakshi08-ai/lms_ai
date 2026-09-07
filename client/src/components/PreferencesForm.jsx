import { Button, Form, Select, Typography } from 'antd';
import { GENRES, READING_GOALS } from '../data/library.js';

export default function PreferencesForm({ initialValues, submitLabel = 'Save preferences', onFinish, extra }) {
  return (
    <Form
      layout="vertical"
      initialValues={{
        genres: initialValues?.genres || [],
        languages: initialValues?.languages || ['English'],
        readingGoal: initialValues?.readingGoal || 'casual',
      }}
      onFinish={onFinish}
    >
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        Pick the genres you enjoy. Elena and the catalog will use these to recommend titles. You can change them anytime
        from Profile.
      </Typography.Paragraph>
      <Form.Item
        name="genres"
        label="Favorite genres"
        rules={[{ required: true, type: 'array', min: 1, message: 'Choose at least one genre' }]}
      >
        <Select
          mode="multiple"
          placeholder="Select genres"
          options={GENRES.map((g) => ({ value: g, label: g }))}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item name="languages" label="Preferred languages">
        <Select
          mode="tags"
          placeholder="English, Hindi…"
          options={['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi'].map((l) => ({ value: l, label: l }))}
        />
      </Form.Item>
      <Form.Item name="readingGoal" label="Reading goal">
        <Select options={READING_GOALS} />
      </Form.Item>
      <div className="flex flex-wrap gap-2">
        <Button type="primary" htmlType="submit">
          {submitLabel}
        </Button>
        {extra}
      </div>
    </Form>
  );
}
